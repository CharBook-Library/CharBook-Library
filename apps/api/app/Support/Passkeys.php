<?php

namespace App\Support;

use App\Contracts\WebAuthnVerifier;

/**
 * Única fuente de verdad para "¿las passkeys están operativas?".
 *
 * Fail-closed por diseño: se exigen DOS condiciones simultáneas y ninguna
 * basta por sí sola —
 *   1) que exista un verificador WebAuthn REAL enlazado en el contenedor
 *      (App\Contracts\WebAuthnVerifier), y
 *   2) que el interruptor operativo PASSKEYS_ENABLED esté activado.
 *
 * Como hoy NO hay ninguna implementación de WebAuthnVerifier enlazada, esto
 * devuelve false SIEMPRE, incluso con PASSKEYS_ENABLED=true. Así una variable
 * de entorno no puede, por sí sola, reactivar el flujo inseguro anterior.
 */
final class Passkeys
{
    public static function operational(): bool
    {
        return app()->bound(WebAuthnVerifier::class)
            && (bool) config('auth.passkeys_enabled');
    }
}
