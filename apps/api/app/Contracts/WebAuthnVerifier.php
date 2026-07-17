<?php

namespace App\Contracts;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contrato del verificador WebAuthn REAL.
 *
 * NO existe implementación todavía y ninguna clase lo enlaza en el contenedor.
 * Mientras eso siga así, PasskeyController permanece fail-closed y jamás emite
 * un token por passkey — ninguna variable de entorno puede cambiar eso.
 *
 * Una futura integración (p. ej. web-auth/webauthn-lib) debe:
 *   1) implementar la verificación criptográfica completa (firma del challenge
 *      con la clave privada, origin, RP ID y signature counter);
 *   2) enlazar esta interfaz con esa implementación real y probada;
 *   3) recién entonces poner PASSKEYS_ENABLED=true.
 *
 * La criptografía WebAuthn NO se implementa a mano en este controlador.
 */
interface WebAuthnVerifier
{
    /** Opciones de registro (challenge) generadas y gestionadas por el verificador real. */
    public function registrationOptions(Request $request, User $user): JsonResponse;

    /** Verifica attestation del registro y persiste la credencial validada. */
    public function register(Request $request, User $user): JsonResponse;

    /** Verifica la afirmación (assertion) criptográfica del login y emite sesión. */
    public function authenticate(Request $request, User $user): JsonResponse;
}
