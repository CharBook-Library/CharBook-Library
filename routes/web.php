<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ObraController;

Route::get('/', function () {
    return view('welcome');
});

Route::resource('obras', ObraController::class);