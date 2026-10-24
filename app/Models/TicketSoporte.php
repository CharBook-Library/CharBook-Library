<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TicketSoporte extends Model
{
    use HasFactory;

    protected $table = 'tickets_soporte';

    protected $fillable = [
        'folio',
        'user_id',
        'asunto',
        'tipo_problema',
        'descripcion',
        'captura_pantalla',
        'estado',
    ];

        public function respuestas()
    {
        return $this->hasMany(RespuestaSoporte::class, 'ticket_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}