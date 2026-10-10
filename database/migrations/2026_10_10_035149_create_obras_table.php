<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('obras', function (Blueprint $table) {
            $table->id();

            // Campos base de la obra
            $table->string('titulo');
            $table->string('autor');
            $table->enum('formato', ['ebook', 'audiolibro']);
            $table->string('portada')->nullable();

            // Campos de la ficha descriptiva (HU-05)
            $table->text('sinopsis');
            $table->string('genero', 50);
            $table->string('idioma', 10);
            $table->integer('duracion')->nullable(); // minutos, solo audiolibro
            $table->integer('paginas')->nullable();  // solo e-book

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('obras');
    }
};