<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            // Quién (nullOnDelete: el log sobrevive aunque se borre la cuenta)
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            // Qué (slug estable: work.moderate, report.resolve, system.flush_jobs…)
            $table->string('action', 80);
            // Sobre qué entidad
            $table->string('entity_type', 40)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('entity_label', 200)->nullable();
            // Por qué + cambios (sanitizados, sin secretos)
            $table->text('reason')->nullable();
            $table->json('changes')->nullable();
            // Desde dónde
            $table->string('ip', 45)->nullable();

            $table->timestamp('created_at');

            $table->index(['action', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
            $table->index(['admin_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
    }
};
