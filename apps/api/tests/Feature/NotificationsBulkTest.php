<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationsBulkTest extends TestCase
{
    use RefreshDatabase;

    private function notify(User $user, string $title = 'Prueba'): Notification
    {
        return Notification::create([
            'user_id' => $user->id,
            'category' => 'system',
            'type' => 'test',
            'emoji' => '🔔',
            'title' => $title,
        ]);
    }

    public function test_bulk_delete_by_ids(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $a = $this->notify($user, 'A');
        $b = $this->notify($user, 'B');
        $c = $this->notify($user, 'C');

        $this->deleteJson('/api/me/notifications/bulk', ['ids' => [$a->id, $b->id]])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertDatabaseMissing('notifications', ['id' => $a->id]);
        $this->assertDatabaseHas('notifications', ['id' => $c->id]);
    }

    public function test_bulk_delete_all(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $this->notify($user);
        $this->notify($user);

        $this->deleteJson('/api/me/notifications/bulk', ['all' => true])
            ->assertOk()
            ->assertJsonPath('deleted', 2);

        $this->assertSame(0, $user->notifications()->count());
    }

    public function test_cannot_delete_other_users_notifications(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $foreign = $this->notify($owner, 'Ajena');

        Sanctum::actingAs($intruder);

        // Los ids ajenos se ignoran (la query está scoped al usuario autenticado).
        $this->deleteJson('/api/me/notifications/bulk', ['ids' => [$foreign->id]])
            ->assertOk()
            ->assertJsonPath('deleted', 0);

        $this->assertDatabaseHas('notifications', ['id' => $foreign->id]);

        // Y "all" solo borra las suyas, no las del resto.
        $this->deleteJson('/api/me/notifications/bulk', ['all' => true])->assertOk();
        $this->assertDatabaseHas('notifications', ['id' => $foreign->id]);
    }

    public function test_requires_ids_or_all(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson('/api/me/notifications/bulk', [])->assertStatus(422);
    }
}
