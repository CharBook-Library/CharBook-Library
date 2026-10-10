<?php

namespace Tests\Feature;

use App\Models\Licencia;
use App\Models\Obra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ObraTest extends TestCase
{
    use RefreshDatabase;

    public function test_puede_listar_obras(): void
    {
        Obra::create([
            'titulo' => 'El Principito',
            'autor' => 'Saint-Exupéry',
            'formato' => 'ebook',
            'sinopsis' => 'Un piloto conoce a un príncipe.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 96,
        ]);

        $response = $this->get('/obras');

        $response->assertStatus(200);
        $response->assertSee('El Principito');
    }

    public function test_puede_registrar_una_obra_con_sinopsis_valida(): void
    {
        $response = $this->post('/obras', [
            'titulo' => 'Cien años de soledad',
            'autor' => 'Gabriel García Márquez',
            'formato' => 'ebook',
            'sinopsis' => 'La historia de la familia Buendía en Macondo.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 471,
        ]);

        $response->assertRedirect('/obras');
        $this->assertDatabaseHas('obras', ['titulo' => 'Cien años de soledad']);
    }

    public function test_no_permite_sinopsis_mayor_a_1000_caracteres(): void
    {
        $response = $this->post('/obras', [
            'titulo' => 'Prueba',
            'autor' => 'Autor',
            'formato' => 'ebook',
            'sinopsis' => str_repeat('a', 1001),
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 100,
        ]);

        $response->assertSessionHasErrors('sinopsis');
    }

    public function test_requiere_paginas_si_es_ebook(): void
    {
        $response = $this->post('/obras', [
            'titulo' => 'Prueba',
            'autor' => 'Autor',
            'formato' => 'ebook',
            'sinopsis' => 'Sinopsis válida',
            'genero' => 'Ficción',
            'idioma' => 'Español',
        ]);

        $response->assertSessionHasErrors('paginas');
    }

    public function test_requiere_duracion_si_es_audiolibro(): void
    {
        $response = $this->post('/obras', [
            'titulo' => 'Prueba',
            'autor' => 'Autor',
            'formato' => 'audiolibro',
            'sinopsis' => 'Sinopsis válida',
            'genero' => 'Ficción',
            'idioma' => 'Español',
        ]);

        $response->assertSessionHasErrors('duracion');
    }

    public function test_puede_buscar_obras_por_titulo_autor_o_genero(): void
    {
        $obra = Obra::create([
            'titulo' => 'El Principito',
            'autor' => 'Saint-Exupéry',
            'formato' => 'ebook',
            'sinopsis' => 'Un piloto conoce a un príncipe.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 96,
        ]);
        Obra::create([
            'titulo' => 'La casa',
            'autor' => 'Otra autora',
            'formato' => 'ebook',
            'sinopsis' => 'Una historia.',
            'genero' => 'Misterio',
            'idioma' => 'Español',
            'paginas' => 120,
        ]);

        $response = $this->get('/obras?buscar=principito');

        $response->assertOk()
            ->assertSee('El Principito')
            ->assertDontSee('La casa')
            ->assertSee(route('obras.show', ['obra' => $obra, 'buscar' => 'principito']), false);
    }

    public function test_detalle_muestra_datos_comerciales_y_conserva_la_busqueda(): void
    {
        $obra = Obra::create([
            'titulo' => 'El Principito',
            'autor' => 'Saint-Exupéry',
            'formato' => 'ebook',
            'sinopsis' => 'Un piloto conoce a un príncipe.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'paginas' => 96,
            'portada' => 'https://example.com/cover.jpg',
            'precio' => 129.50,
            'valoracion' => 4.7,
        ]);

        $response = $this->get(route('obras.show', ['obra' => $obra, 'buscar' => 'principito']));

        $response->assertOk()
            ->assertSee('https://example.com/cover.jpg')
            ->assertSee('El Principito')
            ->assertSee('Saint-Exupéry')
            ->assertSee('Ficción')
            ->assertSee('Un piloto conoce a un príncipe.')
            ->assertSee('96 páginas')
            ->assertSee('$129.50')
            ->assertSee('4.7')
            ->assertSee('Comprar')
            ->assertSee(route('obras.index', ['buscar' => 'principito']), false);
    }

    public function test_muestra_leer_o_escuchar_si_el_usuario_tiene_licencia_vigente(): void
    {
        $user = User::factory()->create();
        $obra = Obra::create([
            'titulo' => 'El Principito',
            'autor' => 'Saint-Exupéry',
            'formato' => 'audiolibro',
            'sinopsis' => 'Un piloto conoce a un príncipe.',
            'genero' => 'Ficción',
            'idioma' => 'Español',
            'duracion' => 98,
            'precio' => 129.50,
        ]);
        Licencia::create([
            'user_id' => $user->id,
            'obra_id' => $obra->id,
            'fecha_inicio' => today()->subDay(),
            'fecha_vencimiento' => today()->addDays(30),
            'activa' => true,
        ]);

        $response = $this->actingAs($user)->get(route('obras.show', $obra));

        $response->assertOk()
            ->assertSee('Ya tienes esta obra')
            ->assertSee('Leer o escuchar')
            ->assertSee('98 min');
    }
}
