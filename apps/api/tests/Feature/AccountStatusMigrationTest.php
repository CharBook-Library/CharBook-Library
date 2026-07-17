<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AccountStatusMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_status_migration_can_roll_back_and_reapply(): void
    {
        $migration = require database_path(
            'migrations/2026_07_16_120000_add_account_status_to_users.php'
        );

        $this->assertAccountStatusColumnsExist();

        $migration->down();

        foreach ($this->accountStatusColumns() as $column) {
            $this->assertFalse(Schema::hasColumn('users', $column));
        }

        $migration->up();

        $this->assertAccountStatusColumnsExist();
    }

    private function assertAccountStatusColumnsExist(): void
    {
        foreach ($this->accountStatusColumns() as $column) {
            $this->assertTrue(Schema::hasColumn('users', $column));
        }
    }

    /** @return list<string> */
    private function accountStatusColumns(): array
    {
        return [
            'account_status',
            'account_status_reason',
            'account_status_changed_at',
            'account_status_expires_at',
            'account_status_changed_by',
        ];
    }
}
