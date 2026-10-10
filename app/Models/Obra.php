<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Obra extends Model
{
    use HasFactory;

    protected $table = 'obras';

    protected $fillable = [
        'titulo',
        'autor',
        'formato',
        'portada',
        'sinopsis',
        'genero',
        'idioma',
        'duracion',
        'paginas',
        'precio',
        'valoracion',
    ];

    protected $casts = [
        'precio' => 'decimal:2',
        'valoracion' => 'decimal:1',
    ];

    public const GENEROS = [
        'Ficción', 'No ficción', 'Romance', 'Ciencia ficción',
        'Fantasía', 'Misterio', 'Biografía', 'Historia',
        'Autoayuda', 'Infantil',
    ];

    public const IDIOMAS = [
        'Español', 'Inglés', 'Francés', 'Alemán', 'Portugués', 'Italiano',
    ];
}
