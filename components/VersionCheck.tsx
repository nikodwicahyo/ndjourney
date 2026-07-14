'use client';

import { useEffect } from 'react';
import { useAppVersion } from '@/hooks/useAppVersion';
import { checkStorageVersion } from '@/lib/app-version';

export default function VersionCheck() {
  useAppVersion();

  useEffect(() => {
    checkStorageVersion();
  }, []);

  return null;
}
