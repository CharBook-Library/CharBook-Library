<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ObraController;
use App\Http\Controllers\LicenciaController;

Route::get('/', function () {
    return view('welcome');
});

// Rutas de la HU-05 (obras)
Route::resource('obras', ObraController::class);

// Rutas de la HU-08 (licencias)
Route::get('/licencias', [LicenciaController::class, 'index'])->name('licencias.index');
Route::get('/licencias/crear', [LicenciaController::class, 'create'])->name('licencias.create');
Route::post('/licencias', [LicenciaController::class, 'store'])->name('licencias.store');
Route::get('/obras/{obra}/validar-acceso', [LicenciaController::class, 'validarAcceso'])->name('licencias.validar');


use App\Http\Controllers\SoporteController;

Route::get('/soporte', [SoporteController::class, 'create'])->name('soporte.create');
Route::post('/soporte', [SoporteController::class, 'store'])->name('soporte.store');


Route::get('/mis-solicitudes', [SoporteController::class, 'index'])->name('soporte.index');
Route::post('/mis-solicitudes/{ticket}/responder', [SoporteController::class, 'responder'])->name('soporte.responder');