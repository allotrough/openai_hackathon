import { describe, expect, it } from 'vitest'
import {
  ReferenceCatalogCache,
  applicableReferenceDNA,
  formatReferenceResearchSummary,
  seedReferenceResearch,
} from './referenceCatalog'

describe('project-local reference catalog', () => {
  it('turns a named Cybertruck mirror cue into adaptable visual DNA for an off-road EV', () => {
    const pack = seedReferenceResearch({
      prompt: 'Use Tesla Cybertruck side-view mirrors on an original off-road EV.',
      targetClass: 'ev',
      targetSpec: { vehicleClass: 'ev', powertrain: 'EV', engineLayout: 'dual motor skateboard', overallWidth: 2, overallHeight: 1.72 },
      now: 42,
    })
    const mirror = pack.dna.find(({ component }) => component === 'side-mirror')

    expect(pack.status).toBe('candidate')
    expect(pack.assets[0]).toMatchObject({ sourceVehicle: 'Tesla Cybertruck', component: 'side-mirror' })
    expect(mirror?.assessment.status).toBe('adapt-with-changes')
    expect(mirror?.assessment.requiredAdaptations.join(' ')).toMatch(/rescale/i)
    expect(mirror?.nonTransferableTraits.join(' ')).toMatch(/badges/i)
    expect(pack.logs).toHaveLength(2)
    expect(applicableReferenceDNA(pack)).toHaveLength(1)
  })

  it('blocks an unsafe frunk transplant into a monster truck package', () => {
    const pack = seedReferenceResearch({
      prompt: 'Apply the front trunk of a Porsche 911 to a monster truck.',
      targetClass: 'monster',
      now: 42,
    })

    expect(pack.status).toBe('rejected')
    expect(pack.dna[0].assessment.status).toBe('incompatible')
    expect(pack.dna[0].assessment.blockers.join(' ')).toMatch(/front cargo volume conflicts/i)
    expect(formatReferenceResearchSummary(pack)).toMatch(/^REJECTED:/)
  })

  it('uses an SSR-safe in-memory cache when browser storage is absent or denied', () => {
    const key = 'test-reference-catalog-memory'
    const pack = seedReferenceResearch({ prompt: 'Use Defender wheel arches on an original electric SUV.', targetClass: 'suv', now: 42 })
    const deniedStorage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    } as unknown as Storage
    const first = new ReferenceCatalogCache({ key, storage: deniedStorage })
    const second = new ReferenceCatalogCache({ key, storage: null })

    first.clear()
    expect(first.save(pack)).toHaveLength(1)
    expect(second.list()).toMatchObject([{ id: pack.id }])
    expect(second.remove(pack.id)).toHaveLength(0)
    second.clear()
  })

  it('keeps unknown named cues low-confidence and local instead of pretending they are web research', () => {
    const pack = seedReferenceResearch({
      prompt: 'Use the mirrors from the fictional Zephyr Q9 on my premium sedan.',
      targetClass: 'road',
      now: 42,
    })

    expect(pack.assets[0].provenance.kind).toBe('reference-cue')
    expect(pack.assets[0].confidence).toBeLessThan(0.5)
    expect(pack.assets[0].sourceVehicle).toBe('User-provided design cue')
  })
})
