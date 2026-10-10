<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabla de licencias (usuario + obra + vigencia)
        Schema::create('licencias', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('obra_id')->constrained('obras')->onDelete('cascade');
            $table->date('fecha_inicio');
            $table->date('fecha_vencimiento');
            $table->boolean('activa')->default(true);
            $table->timestamps();

            // Un usuario no puede tener dos licencias para la misma obra
            $table->unique(['user_id', 'obra_id']);
        });

        // Tabla para registrar intentos no válidos de acceso
        Schema::create('intentos_acceso', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('obra_id')->nullable()->constrained('obras')->onDelete('set null');
            $table->string('motivo'); // sin_licencia, licencia_vencida, usuario_no_autenticado
            $table->timestamp('intentado_en');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intentos_acceso');
        Schema::dropIfExists('licencias');
    }
};