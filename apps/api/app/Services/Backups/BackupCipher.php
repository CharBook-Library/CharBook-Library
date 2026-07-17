<?php

namespace App\Services\Backups;

use RuntimeException;

class BackupCipher
{
    private const MAGIC = 'CHARBK01';
    private const VERSION = 2;
    private const CHUNK_SIZE = 1024 * 1024;
    private const NONCE_BYTES = 12;
    private const TAG_BYTES = 16;

    public function encrypt(string $source, string $destination, string $encodedKey): array
    {
        $key = self::decodeKey($encodedKey);
        $size = filesize($source);
        $sha256 = hash_file('sha256', $source);

        if ($size === false || $sha256 === false) {
            throw new RuntimeException('No se pudo leer el archivo que se va a cifrar.');
        }

        $header = json_encode([
            'version' => self::VERSION,
            'size' => $size,
            'sha256' => $sha256,
            'chunk_size' => self::CHUNK_SIZE,
        ], JSON_THROW_ON_ERROR);
        $headerDigest = hash('sha256', $header, true);

        $input = fopen($source, 'rb');
        $output = fopen($destination, 'wb');
        if (! is_resource($input) || ! is_resource($output)) {
            if (is_resource($input)) {
                fclose($input);
            }
            if (is_resource($output)) {
                fclose($output);
            }
            @unlink($destination);
            throw new RuntimeException('No se pudo abrir el archivo temporal de backup.');
        }
        @chmod($destination, 0600);

        try {
            $this->write($output, self::MAGIC.pack('N', strlen($header)).$header);
            $index = 0;

            while (! feof($input)) {
                $plain = fread($input, self::CHUNK_SIZE);
                if ($plain === false) {
                    throw new RuntimeException('Fallo al leer el backup para cifrarlo.');
                }
                if ($plain === '') {
                    break;
                }

                $nonce = random_bytes(self::NONCE_BYTES);
                $tag = '';
                $aad = self::MAGIC.$headerDigest.pack('N', $index);
                $encrypted = openssl_encrypt(
                    $plain,
                    'aes-256-gcm',
                    $key,
                    OPENSSL_RAW_DATA,
                    $nonce,
                    $tag,
                    $aad,
                    self::TAG_BYTES
                );
                if ($encrypted === false || strlen($tag) !== self::TAG_BYTES) {
                    throw new RuntimeException('OpenSSL no pudo cifrar el backup.');
                }

                $this->write(
                    $output,
                    pack('N', strlen($encrypted)).$nonce.$tag.$encrypted
                );
                $index++;
            }
        } catch (\Throwable $e) {
            fclose($input);
            fclose($output);
            @unlink($destination);
            throw $e;
        }
        fclose($input);
        fclose($output);

        return ['plaintext_sha256' => $sha256, 'plaintext_bytes' => $size];
    }

    public function decrypt(string $source, string $destination, string $encodedKey): array
    {
        $key = self::decodeKey($encodedKey);
        $input = fopen($source, 'rb');
        $output = fopen($destination, 'wb');
        if (! is_resource($input) || ! is_resource($output)) {
            throw new RuntimeException('No se pudo abrir el backup cifrado.');
        }
        @chmod($destination, 0600);

        try {
            if ($this->readExact($input, strlen(self::MAGIC)) !== self::MAGIC) {
                throw new RuntimeException('Formato de backup no reconocido.');
            }

            $headerLength = unpack('Nlength', $this->readExact($input, 4))['length'];
            if ($headerLength < 2 || $headerLength > 4096) {
                throw new RuntimeException('Cabecera de backup invalida.');
            }
            $headerJson = $this->readExact($input, $headerLength);
            $header = json_decode(
                $headerJson,
                true,
                flags: JSON_THROW_ON_ERROR
            );
            $expectedSize = (int) ($header['size'] ?? -1);
            $expectedHash = (string) ($header['sha256'] ?? '');
            if (($header['version'] ?? null) !== self::VERSION
                || ($header['chunk_size'] ?? null) !== self::CHUNK_SIZE
                || $expectedSize < 0
                || $expectedSize > (int) config('backup.limits.max_archive_bytes')
                || ! preg_match('/^[a-f0-9]{64}$/', $expectedHash)) {
                throw new RuntimeException('Metadatos de backup invalidos.');
            }
            $headerDigest = hash('sha256', $headerJson, true);

            $written = 0;
            $index = 0;
            $hash = hash_init('sha256');

            while ($written < $expectedSize) {
                $encryptedLength = unpack('Nlength', $this->readExact($input, 4))['length'];
                if ($encryptedLength < 1 || $encryptedLength > self::CHUNK_SIZE + 64) {
                    throw new RuntimeException('Bloque cifrado invalido.');
                }

                $nonce = $this->readExact($input, self::NONCE_BYTES);
                $tag = $this->readExact($input, self::TAG_BYTES);
                $encrypted = $this->readExact($input, $encryptedLength);
                $plain = openssl_decrypt(
                    $encrypted,
                    'aes-256-gcm',
                    $key,
                    OPENSSL_RAW_DATA,
                    $nonce,
                    $tag,
                    self::MAGIC.$headerDigest.pack('N', $index)
                );
                if ($plain === false || $written + strlen($plain) > $expectedSize) {
                    throw new RuntimeException('El backup esta alterado o usa otra clave.');
                }

                $this->write($output, $plain);
                hash_update($hash, $plain);
                $written += strlen($plain);
                $index++;
            }

            if (fgetc($input) !== false || ! hash_equals($expectedHash, hash_final($hash))) {
                throw new RuntimeException('La integridad del backup no coincide.');
            }
        } catch (\Throwable $e) {
            fclose($input);
            fclose($output);
            @unlink($destination);
            throw $e;
        }

        fclose($input);
        fclose($output);

        return ['sha256' => $expectedHash, 'bytes' => $expectedSize];
    }

    public static function decodeKey(string $encodedKey): string
    {
        $encodedKey = str_starts_with($encodedKey, 'base64:')
            ? substr($encodedKey, 7)
            : $encodedKey;
        $key = base64_decode($encodedKey, true);

        if ($key === false || strlen($key) !== 32) {
            throw new RuntimeException('BACKUP_ENCRYPTION_KEY debe contener exactamente 32 bytes en base64.');
        }

        return $key;
    }

    /** @param resource $stream */
    private function readExact($stream, int $length): string
    {
        $buffer = '';
        while (strlen($buffer) < $length && ! feof($stream)) {
            $part = fread($stream, $length - strlen($buffer));
            if ($part === false) {
                throw new RuntimeException('No se pudo leer el backup cifrado.');
            }
            $buffer .= $part;
        }
        if (strlen($buffer) !== $length) {
            throw new RuntimeException('Backup truncado o incompleto.');
        }

        return $buffer;
    }

    /** @param resource $stream */
    private function write($stream, string $bytes): void
    {
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $written = fwrite($stream, substr($bytes, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('No se pudo escribir el archivo de backup.');
            }
            $offset += $written;
        }
    }
}
