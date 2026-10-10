<?php

namespace Tests\Feature;

use App\Models\Licencia;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LicenciaTest extends TestCase
{
    use RefreshDatabase;

    private function crearObra(): Obra
    {
        return Obra::create([
            'titulo' => 'El Principito',
            'autor' => 'Saint-Exupéry',
            'formato' => 'ebook',
            'sinopsis' => 'Un piloto conoce a un príncipe.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 96,
        ]);
    }

    public function test_puede_listar_licencias_activas(): void
    {
        $user = User::factory()->create();
        $obra = $this->crearObra();

        Licencia::create([
            'user_id' => $user->id,
            'obra_id' => $obra->id,
            'fecha_inicio' => now(),
            'fecha_vencimiento' => now()->addDays(30),
            'activa' => true,
        ]);

        $response = $this->get('/licencias');

        $response->assertStatus(200);
    }

    public function test_bloquea_acceso_sin_licencia(): void
    {
        $user = User::factory()->create();
        $obra = $this->crearObra();

        // Sin autenticar
        $response = $this->get("/obras/{$obra->id}/validar-acceso");
        $response->assertStatus(401);

        // Autenticado sin licencia
        $response = $this->actingAs($user)
            ->get("/obras/{$obra->id}/validar-acceso");
        $response->assertStatus(403);
        $response->assertJson(['acceso' => false]);
    }

    public function test_permite_acceso_con_licencia_vigente(): void
    {
        $user = User::factory()->create();
        $obra = $this->crearObra();

        Licencia::create([
            'user_id' => $user->id,
            'obra_id' => $obra->id,
            'fecha_inicio' => now()->subDay(),
            'fecha_vencimiento' => now()->addDays(30),
            'activa' => true,
        ]);

        $response = $this->actingAs($user)
            ->get("/obras/{$obra->id}/validar-acceso");

        $response->assertStatus(200);
        $response->assertJson(['acceso' => true]);
    }

    public function test_bloquea_acceso_con_licencia_vencida(): void
    {
        $user = User::factory()->create();
        $obra = $this->crearObra();

        Licencia::create([
            'user_id' => $user->id,
            'obra_id' => $obra->id,
            'fecha_inicio' => now()->subDays(60),
            'fecha_vencimiento' => now()->subDay(),
            'activa' => true,
        ]);

        $response = $this->actingAs($user)
            ->get("/obras/{$obra->id}/validar-acceso");

        $response->assertStatus(403);
        $response->assertJson(['acceso' => false]);
    }

    public function test_registra_intento_no_valido(): void
    {
        $user = User::factory()->create();
        $obra = $this->crearObra();

        $this->actingAs($user)
            ->get("/obras/{$obra->id}/validar-acceso");

        $this->assertDatabaseHas('intentos_acceso', [
            'user_id' => $user->id,
            'obra_id' => $obra->id,
            'motivo' => 'sin_licencia',
        ]);
    }
}