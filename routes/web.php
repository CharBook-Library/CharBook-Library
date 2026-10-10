<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

use App\Http\Controllers\LicenciaController;

Route::get('/licencias', [LicenciaController::class, 'index'])->name('licencias.index');
Route::get('/licencias/crear', [LicenciaController::class, 'create'])->name('licencias.create');
Route::post('/licencias', [LicenciaController::class, 'store'])->name('licencias.store');
Route::get('/obras/{obra}/validar-acceso', [LicenciaController::class, 'validarAcceso'])->name('licencias.validar');