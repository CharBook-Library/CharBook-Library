<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RespuestaSoporte extends Model
{
    use HasFactory;

    protected $table = 'respuesta_soportes';

    protected $fillable = ['ticket_id', 'user_id', 'mensaje'];

    public function ticket()
    {
        return $this->belongsTo(TicketSoporte::class, 'ticket_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}