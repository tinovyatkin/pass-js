// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2017-2026 Konstantin Vyatkin <tino@vtkn.io>

// Ambient module declarations for untyped third-party packages.

declare module 'color-name' {
  const table: { [name: string]: [number, number, number] };
  export default table;
}
