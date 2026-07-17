<?php

return [
    'database' => 'charbook_loadtest',
    // Intentionally non-configurable: load tests must never target a remote database.
    'allowed_hosts' => ['127.0.0.1', 'localhost', '::1'],
    'confirmed' => false,
    'users' => (int) env('LOADTEST_USERS', 1000),
    'token_count' => (int) env('LOADTEST_TOKEN_COUNT', 500),
    'user_password' => env('LOADTEST_USER_PASSWORD', 'LoadTest!2026'),
    'controlled_errors' => (bool) env('LOADTEST_CONTROLLED_ERRORS', false),
    'api_rate_limit' => (int) env('LOADTEST_API_RATE_LIMIT', 100000),
    'counts' => [
        'authors' => (int) env('LOADTEST_AUTHORS', 0),
        'books' => (int) env('LOADTEST_BOOKS', 0),
        'categories' => (int) env('LOADTEST_CATEGORIES', 0),
        'favorites' => (int) env('LOADTEST_FAVORITES', 0),
        'reviews' => (int) env('LOADTEST_REVIEWS', 0),
        'comments' => (int) env('LOADTEST_COMMENTS', 0),
        'views' => (int) env('LOADTEST_VIEWS', 0),
        'activities' => (int) env('LOADTEST_ACTIVITIES', 0),
    ],
];
