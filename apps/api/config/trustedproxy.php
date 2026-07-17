<?php

use App\Support\TrustedProxyList;

return [
    // Laravel's global TrustProxies middleware reads this after configuration
    // is loaded, including when config:cache is active. Wildcards and
    // REMOTE_ADDR are rejected: only explicit IPs and CIDR ranges are valid.
    'proxies' => TrustedProxyList::parse(env('TRUSTED_PROXIES')),
];
