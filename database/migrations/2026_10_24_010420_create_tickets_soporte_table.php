<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tickets_soporte', function (Blueprint $table) {
            $table->id();
            $table->string('folio')->unique(); // Ej: TCK-20261024-A1B2
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->string('asunto');
            $table->string('tipo_problema'); // error, duda, sugerencia
            $table->text('descripcion');
            $table->string('captura_pantalla')->nullable(); // ruta de la imagen
            $table->string('estado')->default('pendiente'); // pendiente, resuelto
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tickets_soporte');
    }
};