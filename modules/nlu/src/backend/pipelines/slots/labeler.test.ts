import { NLU } from 'botpress/sdk'
import ms from 'ms'

import { ExtractedEntity, ExtractedSlot, UtteranceClass } from '../../engine2'
import { SPACE } from '../../tools/token-utils'
import { BIO, Sequence, Token } from '../../typings'

import {
  combineSlots,
  isTagAValidSlot,
  labelizeUtterance,
  labelizeUtterance2,
  predictionLabelToTagResult,
  TagResult
} from './labeler'

const AN_UTTERANCE: Sequence = {
  cannonical: 'Careful my friend, Alex W. is one of us',
  intent: 'warn',
  tokens: [
    { tag: 'o', cannonical: 'careful', matchedEntities: [] },
    { tag: 'B', cannonical: 'my', slot: 'listener', matchedEntities: ['friend'] },
    { tag: 'I', cannonical: 'friend', slot: 'listener', matchedEntities: ['friend'] },
    { tag: 'o', cannonical: ',' }, // no matched entities is on purpose here
    { tag: 'B', cannonical: 'Alex', slot: 'person', matchedEntities: [] },
    { tag: 'I', cannonical: 'W.', slot: 'person', matchedEntities: [] },
    { tag: 'o', cannonical: 'is' },
    { tag: 'o', cannonical: 'one' },
    { tag: 'o', cannonical: 'of' },
    { tag: 'B', cannonical: 'us', slot: 'group' }
  ] as Token[]
}

describe('CRF labels for utterance', () => {
  test('without slots', () => {
    const toks = 'My mame is Heisenberg and I am the danger'.split(/(\s)/g)
    const utterance = new UtteranceClass(toks, new Array(toks.length).fill([0]))

    const labels = labelizeUtterance2(utterance)

    labels.forEach(l => expect(l).toEqual('o'))
  })

  test('with slots', () => {
    const toks = 'Careful my friend, Alex W. is one of us'.split(/(\s)/g)
    const utterance = new UtteranceClass(toks, new Array(toks.length).fill([0]))
    utterance.tagSlot({ name: 'listener', source: 'my friend' } as ExtractedSlot, 8, 18)
    utterance.tagEntity({ value: 'my friend' } as ExtractedEntity, 8, 18)
    utterance.tagSlot({ name: 'person', source: 'Alex W.' } as ExtractedSlot, 19, 26)
    utterance.tagSlot({ name: 'group', source: 'us' } as ExtractedSlot, 37, 39)

    const labels = labelizeUtterance2(utterance)

    expect(labels[2]).toEqual('B-listener')
    expect(labels[3]).toEqual('I-listener')
    expect(labels[4]).toEqual('I-listener')

    expect(labels[6]).toEqual('B-person/any')
    expect(labels[7]).toEqual('I-person/any')
    expect(labels[8]).toEqual('I-person/any')

    expect(labels[16]).toEqual('B-group/any')

    Array.from([0, 1, 5, 9, 10, 11, 12, 13, 14, 15]).forEach(i => {
      expect(labels[i]).toEqual('o')
    })
  })
})

test('labelizeUtterance', () => {
  const labels = labelizeUtterance(AN_UTTERANCE)
  expect(labels.length).toEqual(AN_UTTERANCE.tokens.length)
  Array.from([0, 3, 6, 7, 8]).forEach(i => {
    expect(labels[i]).toEqual('o')
  })
  expect(labels[1]).toEqual('B-listener')
  expect(labels[2]).toEqual('I-listener')
  expect(labels[4]).toEqual('B-person/any')
  expect(labels[5]).toEqual('I-person/any')
  expect(labels[9]).toEqual('B-group/any')
})

test('isTagAValidSlot', () => {
  const token = { cannonical: 'a token' } as Token // for testing purposes
  const tag = { tag: BIO.OUT, probability: 0.5, name: '' } as TagResult
  const tag1 = { tag: BIO.BEGINNING, probability: 0.5, name: 'coffee-type' } as TagResult
  const intentDef = {
    name: 'brew coffee',
    slots: [
      {
        name: 'coffee-type'
      }
    ]
  } as NLU.IntentDefinition

  expect(isTagAValidSlot(undefined, tag, intentDef)).toBeFalsy()
  expect(isTagAValidSlot(token, undefined, intentDef)).toBeFalsy()
  expect(isTagAValidSlot(token, { ...tag1, probability: 0.1 }, intentDef)).toBeFalsy()
  expect(isTagAValidSlot(token, tag1, intentDef)).toBeTruthy()
})

describe('combineSlots', () => {
  const token = {
    cannonical: 'LeGrand',
    value: `${SPACE}LeGrand`
  } as Token

  test('without existing slot', () => {
    const newSlot = {
      source: 'antoine',
      value: 'antoine'
    } as NLU.Slot

    const res = combineSlots(undefined, token, { tag: 'B', name: 'name', probability: 0.5 }, newSlot)
    const res1 = combineSlots(undefined, token, { tag: 'I', name: 'name', probability: 0.5 }, newSlot)

    expect(res).toEqual(newSlot)
    expect(res1).toEqual(newSlot)
  })

  test('existing "ANY slot" and a new "INSIDE & ANY slot"', () => {
    const existing = {
      source: 'antoine',
      value: 'antoine'
    } as NLU.Slot

    const newSlot = {
      source: 'LeGrand'
    } as NLU.Slot

    const res = combineSlots(existing, token, { tag: 'I', name: 'name', probability: 0.5 }, newSlot)

    expect(res.source).toEqual('antoine LeGrand')
    expect(res.value).toEqual('antoine LeGrand')
  })

  test('existing "ENTITY slot" and a new "INSIDE & ANY slot"', () => {
    const existing = {
      source: '2 hours',
      value: ms('2 hours'),
      entity: {
        data: {
          /* not important fo this test */
        },
        meta: {},
        type: 'time'
      }
    } as NLU.Slot

    const newSlot = {
      source: 'LeGrand'
    } as NLU.Slot

    const res = combineSlots(existing, token, { tag: 'I', name: 'name', probability: 0.5 }, newSlot)

    expect(res).toEqual(existing)
  })

  test('existing "ANY slot" and a new "INSIDE & ENTITY slot"', () => {
    // Not sure this case is even possible.
    // if yes, we might want to change this behaviour, leaving this as is for the moment
    const existing = {
      source: '2',
      value: '2'
    } as NLU.Slot

    const newSlot = {
      source: '2 hours',
      value: ms('2 hours'),
      entity: {
        data: {
          /* not important fo this test */
        },
        meta: {},
        type: 'time'
      }
    } as NLU.Slot

    const res = combineSlots(existing, token, { tag: 'I', name: 'time', probability: 0.5 }, newSlot)

    expect(res).toEqual(existing)
  })

  test('existing "ENTITY slot" a new "INSIDE & ENTITY slot"', () => {
    // Not sure this case is even possible.
    // if yes, we might want to change this behaviour, leaving this as is for the moment
    const existing = {
      source: '2',
      value: ms('2 hours'),
      entity: {
        data: {
          /* not important fo this test */
        },
        meta: {},
        type: 'time'
      }
    } as NLU.Slot

    const newSlot = {
      source: '2 hours',
      value: ms('2 hours'),
      entity: {
        data: {
          /* not important fo this test */
        },
        meta: {},
        type: 'time'
      }
    } as NLU.Slot

    const res = combineSlots(existing, token, { tag: 'I', name: 'time', probability: 0.5 }, newSlot)

    expect(res).toEqual(existing)
  })

  test('existing slot and new BEGIN slot', () => {
    const tagRes: TagResult = { tag: 'B', name: 'name', probability: 0.5 }
    const existing = {
      source: 'Han-Thony',
      value: 'Han-Thony',
      confidence: 0.2
    } as NLU.Slot

    const newSlot = {
      source: 'Justin Trudeau',
      value: 'Justin Trudeau',
      confidence: 0.1
    } as NLU.Slot

    const res0 = combineSlots(existing, token, tagRes, newSlot)
    const res1 = combineSlots(existing, token, tagRes, { ...newSlot, confidence: 0.9 })
    const res2 = combineSlots(existing, token, tagRes, { ...newSlot, confidence: existing.confidence })

    expect(res0.source).toEqual(existing.source)
    expect(res0.value).toEqual(existing.value)
    expect(res1.source).toEqual(newSlot.source)
    expect(res1.value).toEqual(newSlot.value)
    expect(res2.source).toEqual(existing.source)
    expect(res2.value).toEqual(existing.value)
  })
})

test('predictionLabelToTagResult', () => {
  const probsOut = {
    o: 0.9,
    'B-slot1': 0.25,
    'B-slot1/any': 0.25,
    'I-slot1': 0.25,
    'I-slot1/any': 0.25
  }

  const probs = {
    'B-slot1': 0.6,
    'B-slot1/any': 0.2,
    'I-slot1': 0.1,
    'I-slot1/any': 0.1,
    'B-slot2': 0.01,
    'I-slot2': 0.01
  }

  const probsAny = {
    'B-slot1': 0.1,
    'B-slot1/any': 0.2,
    'I-slot1': 0.1,
    'I-slot1/any': 0.5,
    'B-slot2': 0.01,
    'I-slot2': 0.01
  }

  const resOut = predictionLabelToTagResult(probsOut)
  const res = predictionLabelToTagResult(probs)
  const resAny = predictionLabelToTagResult(probsAny)

  expect(resOut).toEqual({
    tag: 'o',
    name: '',
    probability: 0.9
  })

  expect(res).toEqual({
    tag: 'B',
    name: 'slot1',
    probability: 0.6
  })

  expect(resAny).toEqual({
    tag: 'I',
    name: 'slot1',
    probability: 0.5
  })
})
