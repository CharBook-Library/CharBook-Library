<?php

namespace App\Http\Middleware;

use App\Services\AccountStatusService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    public function __construct(private readonly AccountStatusService $accountStatus) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        if ($blocked = $this->accountStatus->blockedResponse($user)) {
            return $blocked;
        }

        return $next($request);
    }
}
