<?php

namespace Tests\Feature;

use App\Models\CreatorApplication;
use App\Models\Notification;
use App\Models\User;
use App\Services\CreatorApplicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CreatorApplicationNotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['name' => 'creator', 'guard_name' => 'web']);
    }

    public function test_each_admin_status_decision_notifies_the_applicant_with_the_response(): void
    {
        $reviewer = User::factory()->create();
        $service = app(CreatorApplicationService::class);

        $changesApp = $this->application();
        $service->requestChanges($changesApp, $reviewer, 'Agrega una muestra más reciente.');

        $rejectedApp = $this->application();
        $service->reject($rejectedApp, $reviewer, 'La muestra no cumple los criterios editoriales.');

        $approvedApp = $this->application(['score_total' => 8]);
        $service->approve($approvedApp, $reviewer, 'Bienvenida al equipo editorial.');

        $notifications = Notification::query()
            ->whereIn('user_id', [$changesApp->user_id, $rejectedApp->user_id, $approvedApp->user_id])
            ->get()
            ->keyBy('user_id');

        $this->assertCount(3, $notifications);
        $this->assertSame('changes_requested', $notifications[$changesApp->user_id]->data['status']);
        $this->assertSame('rejected', $notifications[$rejectedApp->user_id]->data['status']);
        $this->assertSame('approved', $notifications[$approvedApp->user_id]->data['status']);

        foreach ([
            [$changesApp, 'Agrega una muestra más reciente.'],
            [$rejectedApp, 'La muestra no cumple los criterios editoriales.'],
            [$approvedApp, 'Bienvenida al equipo editorial.'],
        ] as [$application, $response]) {
            $notification = $notifications[$application->user_id];
            $this->assertSame('system', $notification->category);
            $this->assertSame('creator_application_status_changed', $notification->type);
            $this->assertSame('/mi-solicitud', $notification->link);
            $this->assertStringContainsString($application->folio, $notification->body);
            $this->assertStringContainsString($response, $notification->body);
            $this->assertSame($application->folio, $notification->data['folio']);
        }
    }

    public function test_same_status_does_not_create_an_additional_notification(): void
    {
        $application = $this->application();
        $reviewer = User::factory()->create();
        $service = app(CreatorApplicationService::class);

        $service->requestChanges($application, $reviewer, 'Agrega una muestra más reciente.');
        $service->requestChanges($application, $reviewer, 'Incluye también tu calendario editorial.');

        $this->assertSame(1, Notification::where('user_id', $application->user_id)->count());
    }

    public function test_folio_is_derived_from_the_persisted_application_id(): void
    {
        $application = $this->application();

        $this->assertSame(
            'CRE-' . str_pad((string) $application->id, 6, '0', STR_PAD_LEFT),
            $application->folio,
        );
    }

    public function test_reader_application_response_includes_folio_date_and_status(): void
    {
        $application = $this->application();
        Sanctum::actingAs($application->user);

        $this->getJson('/api/me/creator-application')
            ->assertOk()
            ->assertJsonPath('data.folio', $application->folio)
            ->assertJsonPath('data.status', CreatorApplication::STATUS_PENDING)
            ->assertJsonStructure(['data' => ['submitted_at']]);
    }

    private function application(array $overrides = []): CreatorApplication
    {
        $user = User::factory()->create();

        return CreatorApplication::create(array_merge([
            'user_id' => $user->id,
            'status' => CreatorApplication::STATUS_PENDING,
            'display_name' => 'Autora de prueba',
            'bio_long' => str_repeat('Bio de prueba. ', 40),
            'sample_url' => 'https://example.com/muestra',
            'genres' => ['fantasia'],
            'languages' => ['es'],
            'why_join' => str_repeat('Motivo de prueba. ', 20),
            'submitted_at' => now(),
        ], $overrides));
    }
}
