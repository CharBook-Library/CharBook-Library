<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IntentoAcceso extends Model
{
    use HasFactory;

    protected $table = 'intentos_acceso';

    protected $fillable = [
        'user_id',
        'obra_id',
        'motivo',
        'intentado_en',
    ];

    protected $casts = [
        'intentado_en' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function obra()
    {
        return $this->belongsTo(Obra::class);
    }
}