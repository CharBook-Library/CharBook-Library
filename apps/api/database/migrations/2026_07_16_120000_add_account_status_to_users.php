<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_status', 20)->default('active')->index();
            $table->text('account_status_reason')->nullable();
            $table->timestamp('account_status_changed_at')->nullable();
            $table->timestamp('account_status_expires_at')->nullable()->index();
            $table->foreignId('account_status_changed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('account_status_changed_by');
            $table->dropIndex(['account_status_expires_at']);
            $table->dropIndex(['account_status']);
            $table->dropColumn([
                'account_status',
                'account_status_reason',
                'account_status_changed_at',
                'account_status_expires_at',
            ]);
        });
    }
};
