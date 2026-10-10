<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Licencia extends Model
{
    use HasFactory;

    protected $table = 'licencias';

    protected $fillable = [
        'user_id',
        'obra_id',
        'fecha_inicio',
        'fecha_vencimiento',
        'activa',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_vencimiento' => 'date',
        'activa' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function obra()
    {
        return $this->belongsTo(Obra::class);
    }

    public function estaVigente(): bool
    {
        return $this->activa && $this->fecha_vencimiento->isFuture();
    }
}