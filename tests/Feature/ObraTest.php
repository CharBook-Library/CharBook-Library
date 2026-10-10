<?php

namespace Tests\Feature;

use App\Models\Obra;
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
}