<?php

namespace App\Http\Controllers;

use App\Models\Licencia;
use App\Models\IntentoAcceso;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;

class LicenciaController extends Controller
{
    // Listar todas las licencias activas (para administrador)
    public function index()
    {
        $licencias = Licencia::with(['user', 'obra'])
            ->where('activa', true)
            ->where('fecha_vencimiento', '>=', Carbon::today())
            ->get();

        return view('licencias.index', compact('licencias'));
    }

    // Formulario para crear una licencia
    public function create()
    {
        return view('licencias.create', [
            'usuarios' => User::all(),
            'obras' => Obra::all(),
        ]);
    }

    // Guardar nueva licencia
    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id'           => 'required|exists:users,id',
            'obra_id'           => 'required|exists:obras,id',
            'fecha_inicio'      => 'required|date',
            'fecha_vencimiento' => 'required|date|after:fecha_inicio',
        ]);

        Licencia::create($data);

        return redirect()->route('licencias.index')
            ->with('success', 'Licencia creada correctamente.');
    }

    // Validar acceso a una obra (criterios de aceptación HU-08)
    public function validarAcceso(Request $request, Obra $obra)
    {
        $user = $request->user();

        // 1. Usuario no autenticado
        if (!$user) {
            IntentoAcceso::create([
                'user_id'      => null,
                'obra_id'      => $obra->id,
                'motivo'       => 'usuario_no_autenticado',
                'intentado_en' => now(),
            ]);

            return response()->json([
                'acceso'  => false,
                'mensaje' => 'Debes iniciar sesión para acceder al contenido.',
            ], 401);
        }

        // 2. Buscar licencia activa del usuario para esta obra
        $licencia = Licencia::where('user_id', $user->id)
            ->where('obra_id', $obra->id)
            ->where('activa', true)
            ->first();

        // 3. Sin licencia
        if (!$licencia) {
            IntentoAcceso::create([
                'user_id'      => $user->id,
                'obra_id'      => $obra->id,
                'motivo'       => 'sin_licencia',
                'intentado_en' => now(),
            ]);

            return response()->json([
                'acceso'  => false,
                'mensaje' => 'No tienes licencia para esta obra.',
            ], 403);
        }

        // 4. Licencia vencida
        if ($licencia->fecha_vencimiento->isPast()) {
            $licencia->update(['activa' => false]);

            IntentoAcceso::create([
                'user_id'      => $user->id,
                'obra_id'      => $obra->id,
                'motivo'       => 'licencia_vencida',
                'intentado_en' => now(),
            ]);

            return response()->json([
                'acceso'  => false,
                'mensaje' => 'Tu licencia ha vencido. Renueva para seguir accediendo.',
            ], 403);
        }

        // 5. Acceso válido
        return response()->json([
            'acceso'   => true,
            'mensaje'  => 'Acceso permitido.',
            'licencia' => $licencia,
        ]);
    }
}