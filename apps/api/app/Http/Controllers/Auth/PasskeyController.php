<?php

namespace App\Http\Controllers\Auth;

use App\Contracts\WebAuthnVerifier;
use App\Http\Controllers\Controller;
use App\Models\Passkey;
use App\Services\AccountStatusService;
use App\Support\Passkeys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Registro y verificación de Passkeys (WebAuthn).
 *
 *  ⚠️ FAIL-CLOSED: passkeys NO operativas.
 *
 *  La implementación previa NO verificaba la afirmación criptográfica WebAuthn:
 *  emitía un token de sesión de 30 días con solo poseer un `credential_id`
 *  (identificador PÚBLICO en WebAuthn) + un challenge, sin comprobar jamás la
 *  firma contra la clave pública almacenada; y el registro guardaba cualquier
 *  credencial sin attestation. Ese código inseguro fue ELIMINADO.
 *
 *  El registro y el login por passkey solo funcionarán cuando exista un
 *  verificador WebAuthn REAL enlazado (App\Contracts\WebAuthnVerifier) — ver
 *  App\Support\Passkeys::operational(). Ninguna variable de entorno reactiva
 *  por sí sola el flujo: PASSKEYS_ENABLED=true sin verificador sigue bloqueado.
 *  Las credenciales existentes se conservan en la base pero no se pueden usar.
 */
class PasskeyController extends Controller
{
    public function __construct(private readonly AccountStatusService $accountStatus) {}

    /**
     * Fail-closed: sin verificador WebAuthn real, todo flujo que emita o enrole
     * credenciales passkey se rechaza con un contrato JSON estable. Devuelve
     * null solo si las passkeys están realmente operativas (verificador real
     * enlazado + interruptor activo), en cuyo caso el llamador delega en él.
     */
    private function unavailableResponse(): ?JsonResponse
    {
        if (Passkeys::operational()) {
            return null;
        }

        return response()->json([
            'code' => 'PASSKEYS_NOT_IMPLEMENTED',
            'message' => 'El acceso con passkey no está disponible: falta la '
                . 'verificación WebAuthn. Usa tu contraseña y otro método de verificación.',
        ], 501);
    }

    /** GET /api/me/passkeys — listar credenciales (nunca expone credential_id/public_key). */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->passkeys()->orderByDesc('created_at')->get([
                'id', 'label', 'device_type', 'transports', 'last_used_at', 'created_at',
            ]),
        ]);
    }

    /** POST /api/me/passkeys/options — challenge de registro (delegado al verificador real). */
    public function registerOptions(Request $request): JsonResponse
    {
        if ($unavailable = $this->unavailableResponse()) {
            return $unavailable;
        }

        // Solo alcanzable con un verificador WebAuthn real enlazado (trabajo futuro).
        return app(WebAuthnVerifier::class)->registrationOptions($request, $request->user());
    }

    /** POST /api/me/passkeys — registrar credencial (requiere attestation real). */
    public function store(Request $request): JsonResponse
    {
        if ($unavailable = $this->unavailableResponse()) {
            return $unavailable;
        }

        // Solo alcanzable con un verificador WebAuthn real enlazado (trabajo futuro).
        return app(WebAuthnVerifier::class)->register($request, $request->user());
    }

    /** DELETE /api/me/passkeys/{id} — el usuario siempre puede retirar su credencial. */
    public function destroy(Request $request, Passkey $passkey): JsonResponse
    {
        if ($passkey->user_id !== $request->user()->id) abort(403);
        $passkey->delete();

        $user = $request->user()->fresh();
        if ($user->passkeys()->count() === 0) {
            $methods = collect($user->two_factor_methods ?? [])->reject('passkey')->values()->all();
            $user->update(['two_factor_methods' => $methods, 'two_factor_enabled' => count($methods) > 0]);
        }

        return response()->json(['message' => 'Passkey eliminada.']);
    }

    /** POST /api/auth/passkey/verify — login por passkey. */
    public function verify(Request $request): JsonResponse
    {
        // Se valida y resuelve el usuario del challenge de 2FA para poder aplicar
        // el bloqueo de cuenta con el motivo exacto (suspendida/baneada → 423).
        $data = $request->validate([
            'challenge' => ['required', 'string'],
            'credential_id' => ['required', 'string'],
        ]);
        $uid = cache()->get("2fa_challenge:{$data['challenge']}");
        if (! $uid) throw ValidationException::withMessages(['challenge' => ['Sesión expirada.']]);
        $user = \App\Models\User::findOrFail($uid);

        if ($blocked = $this->accountStatus->blockedResponse($user)) {
            return $blocked;
        }

        // Fail-closed: sin verificador WebAuthn real jamás se emite token. El
        // código anterior (autenticar por mera presencia de credential_id) fue
        // eliminado; ninguna variable de entorno puede reintroducirlo.
        if ($unavailable = $this->unavailableResponse()) {
            return $unavailable;
        }

        // Solo alcanzable con un verificador WebAuthn real enlazado (trabajo futuro):
        // la verificación criptográfica (firma, origin, RP ID, counter) y la
        // emisión de sesión son responsabilidad de esa implementación.
        return app(WebAuthnVerifier::class)->authenticate($request, $user);
    }
}
