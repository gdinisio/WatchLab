import { useMemo } from 'react'
import type { MaterialLibrary } from '../materials/library'
import { ExplodeDriver, maxOrderOf } from '../parts/explode'
import { Part } from '../parts/Part'
import { ALL_PARTS } from '../parts/registry'
import { Annotations } from './Annotations'
import { LumeDriver } from './LumeDriver'

export interface WatchProps {
  lib: MaterialLibrary
  /** Low-spec path for the multi-sample transmission pass. */
  simpleGlass?: boolean
}

export function Watch({ lib, simpleGlass = false }: WatchProps) {
  const maxOrder = useMemo(() => maxOrderOf(ALL_PARTS), [])

  return (
    <group>
      <ExplodeDriver />
      <LumeDriver lib={lib} />
      {ALL_PARTS.map((def) => (
        <Part key={def.id} def={def} lib={lib} maxOrder={maxOrder} simpleGlass={simpleGlass} />
      ))}
      <Annotations />
    </group>
  )
}
