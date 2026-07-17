<?php

namespace App\Support;

final class TrustedProxyList
{
    /**
     * @return list<string>
     */
    public static function parse(?string $configured): array
    {
        $values = array_map('trim', explode(',', (string) $configured));

        return array_values(array_unique(array_filter(
            $values,
            static fn (string $value): bool => self::isExplicitIpOrCidr($value)
        )));
    }

    private static function isExplicitIpOrCidr(string $value): bool
    {
        if ($value === '' || in_array($value, ['*', '**', 'REMOTE_ADDR'], true)) {
            return false;
        }

        if (! str_contains($value, '/')) {
            return filter_var($value, FILTER_VALIDATE_IP) !== false;
        }

        [$ip, $prefix] = array_pad(explode('/', $value, 2), 2, null);
        if ($prefix === null || ! ctype_digit($prefix) || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return false;
        }

        $maximum = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false ? 32 : 128;

        return (int) $prefix <= $maximum;
    }
}
