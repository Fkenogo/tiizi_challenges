import { configure } from '@testing-library/react';

// Cold CI runners can take over the 1s default to resolve a first async query.
configure({ asyncUtilTimeout: 4000 });
