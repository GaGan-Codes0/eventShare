import { readFileSync } from 'node:fs';

import { Controller, Get, Header } from '@nestjs/common';

/** The klickers.app landing page: one self-contained HTML file in apps/api/site, read once at startup. */
const LANDING = readFileSync(new URL('../../site/index.html', import.meta.url), 'utf8');

@Controller()
export class SiteController {
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'public, max-age=300')
  landing() {
    return LANDING;
  }
}
