
import diff, { equal, similar, ChangeSet, ChangeRm, ChangeAdd, diffSeq, ArrayChange, Change, ChangeType } from "../src"
import lcs_greedy, { LcsOpsTypes } from "../src/greedy_lcs"
import { AsyncTest, Expect, Test, TestCase, TestFixture, FocusTest } from "alsatian"
import { Range, Seq, Map as IMap, Record } from "immutable"

const odiff = Object.assign(function(a: any, b: any) {
  return diff(a, b)
}, {
    equal,
    similar,
  })

function expectDiff(from: any, to: any, expected: ArrayChange<any>[]) {
  const diffs = odiff(from, to)
  Expect(diffs).toEqual(expected)
}

@TestFixture()
export class Tests {

  @Test()
  @TestCase(Seq([0, 1, 2, 3]), Seq([0, 1, 3, 4]))
  @TestCase(Range(0, 100), Range(30, 70).toList().concat(Range(80, 90)).toSeq())
  @TestCase(Range(0, 20).toList().concat(Range(40, 60), Range(80, 100)).toSeq(), Range(10, 90))
  @TestCase(Range(0, 300), Range(0, 300).toList().shift().delete(40).set(40, -100).delete(40).push(0).toSeq())
  "lcs_greedy correct splices"(a: Seq.Indexed<any>, b: Seq.Indexed<any>) {
    const splices = (lcs_greedy(a, b))

    let v = a
    splices.forEach(op => {
      if (op.type === LcsOpsTypes.SPLICE) {
        v = v.splice(op.index, op.remove, ...op.add)
      } else {
        v = v.splice(op.index, 1, op.to)
      }
    })
    Expect(v.equals(b)).toBeTruthy()
  }

  @Test()
  "simple value test"() {
    expectDiff(1, 2, [{
      type: ChangeType.SET,
      path: [],
      val: 2,
    }])
  }

  @Test()
  "simple value test - strong equality"() {
    expectDiff("", 0, [{
      type: ChangeType.SET,
      path: [],
      val: 0,
    }])
  }

  @Test()
  "NaN test"() {
    expectDiff({ x: NaN }, { x: NaN }, [])
  }

  @Test()
  "simple object diff"() {
    expectDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 2, u: 3 },
      [
        {
          type: ChangeType.REMOVE,
          path: ["c"],
          num: 1,
        },
        {
          type: ChangeType.ADD,
          path: ["u"],
          vals: [3],
        },
      ],
    )
  }

  @Test()
  "simple array diff - rm"() {
    const a = [1, 2, 3]
    const b: any[] = []

    const diffs = odiff(a, b)
    Expect(diffs.length).toEqual(1)

    const d = diffs[0] as ChangeRm
    Expect(d.type).toEqual("rm")
    Expect(d.path.length).toEqual(1)
    Expect(d.path[0]).toEqual(0)
    Expect(d.num).toEqual(3)
  }

  @Test()
  "simple array diff - add"() {
    const a: any[] = []
    const b = [1, 2, 3]

    const diffs = odiff(a, b)
    Expect(diffs.length).toEqual(1)

    const d = diffs[0] as ChangeAdd<any>
    Expect(d.type).toEqual("add")
    Expect(d.path.length).toEqual(1)
    Expect(d.path[0]).toEqual(0)
    Expect(odiff.equal(d.vals, [1, 2, 3])).toBeTruthy()
  }

  @Test()
  "simple array diff - change"() {
    const a = [1, 2, 3]
    const b = [1, 2, 4]

    const diffs = odiff(a, b)
    Expect(diffs.length).toEqual(1)

    const d = diffs[0] as ChangeSet<any>
    Expect(d.type).toEqual("set")
    Expect(odiff.equal(d.path, [2])).toBeTruthy()
    Expect(d.val).toEqual(4)
  }

  @Test()
  "simple array diff - move far"() {
    const a = Range(0, 300).toArray()
    // moving 0 to the end will cause the greedy algorithm to perform a bad choice
    const b = Range(0, 300).toList().shift().push(0).toArray()

    expectDiff(a, b, [
      {
        type: ChangeType.ADD,
        path: [0],
        vals: Range(1, 300).toArray(),
      },
      {
        type: ChangeType.REMOVE,
        path: [300],
        num: 299,
      },
    ])
  }

  @Test()
  "array diff - added one, then removed one"() {
    const a = [1, 2, 3, 4, 5]
    const b = [1, 1.1, 2, 3, 5]

    const diffs = odiff(a, b)
    Expect(diffs.length).toEqual(2)

    const d0 = diffs[0] as ChangeAdd<any>
    Expect(d0.type).toEqual("add")
    Expect(d0.path.length).toEqual(1)
    Expect(d0.path[0]).toEqual(1)
    Expect(odiff.equal(d0.vals, [1.1])).toBeTruthy()

    const d1 = diffs[1] as ChangeRm
    Expect(d1.type).toEqual("rm")
    Expect(d1.path.length).toEqual(1)
    Expect(d1.path[0]).toEqual(4)
    Expect(d1.num).toEqual(1)
  }

  @Test()
  "complex array diff"() {
    const v1 = { a: 1, b: 2, c: 3 }
    const v2 = { x: 1, y: 2, z: 3 }
    const v3 = { w: 9, q: 8, r: 7 }
    const v4 = { t: 4, y: 5, u: 6 }
    const v5 = { x: 1, y: "3", z: 3 }
    const v6 = { t: 9, y: 9, u: 9 }
    const a = [v1, v2, v3]
    const b = [v1, v4, v5, v6, v3]

    const diffs = odiff(a, b)
    const expectedDiffs: ArrayChange<any>[] = [
      {
        type: ChangeType.SET,
        path: [1],
        val: v4,
      },
      {
        type: ChangeType.ADD,
        path: [2],
        vals: [v5, v6],
      },
    ]

    Expect(diffs).toEqual(expectedDiffs)
  }

  @Test()
  "complex array diff - distinguish set and add"() {
    const v1 = { a: 1, b: 2 }
    const v2 = { a: 3, b: 4 }
    const v3 = { a: 5, b: 6 }
    const v4 = { a: 7, b: 8 }
    const v5 = { a: 9, b: 8 }
    const a = [v1, v2, v3, v4]
    const b = [v1, v5, v2, v3, v4]

    expectDiff(a, b, [
      {
        type: ChangeType.ADD,
        path: [1],
        vals: [v5],
      },
    ])
  }

  @Test()
  "complex array diff - distinguish set and rm"() {
    const v1 = { a: 1, b: 2 }
    const v2 = { a: 3, b: 4 }
    const v3 = { a: 5, b: 6 }
    const v4 = { a: 7, b: 8 }
    const v5 = { a: 9, b: 8 }
    const a = [v1, v5, v2, v3, v4]
    const b = [v1, v2, v3, v4]

    expectDiff(a, b, [
      {
        type: ChangeType.REMOVE,
        path: [1],
        num: 1,
      },
    ])
  }

  @Test()
  "complex array diff - change without id, then add"() {
    const v1 = { a: 1, b: 2 }
    const v2a = { a: 9, b: 8 }
    const v2b = { a: 9, b: "7" }
    const v3 = { a: 3, b: 4 }
    const v4 = { a: 5, b: 6 }
    const v5 = { a: 7, b: 8 }
    const v6 = { a: 8, b: 1 }
    const a = [v1, v2a, v3, v4, v5]
    const b = [v1, v2b, v6, v3, v4, v5]

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: [1, "b"],
        val: "7",
      },
      {
        type: ChangeType.ADD,
        path: [2],
        vals: [v6],
      },
    ])
  }

  @Test()
  "complex array diff - change with id, then add"() {
    const v1 = { a: 1, b: 2 }
    const v2a = { a: 9, b: 8, id: 2 }
    const v2b = { a: 9, b: "7", id: 2 }
    const v3 = { a: 3, b: 4 }
    const v4 = { a: 5, b: 6 }
    const v5 = { a: 7, b: 8 }
    const v6 = { a: 8, b: 1 }
    const a = [v1, v2a, v3, v4, v5]
    const b = [v1, v2b, v6, v3, v4, v5]

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: [1, "b"],
        val: "7",
      },
      {
        type: ChangeType.ADD,
        path: [2],
        vals: [v6],
      },
    ])
  }

  @Test()
  "complex array diff - change many with id"() {
    const v1a = { a: 1, b: 2, id: "id" }
    const v1b = { a: 1, b: 3, id: "id" }
    const v2a = { a: 9, b: 8, id: 2 }
    const v2b = { a: 9, id: 2 }
    const v3 = { a: 3, b: 4 }
    const v4a = { a: 5, b: 6, id: 89 }
    const v4b = { a: 5, b: 6, id: 89 }
    const v5a = { a: 7, id: "" }
    const v5b = { a: 7, c: 8, id: "" }
    const v6 = "id"
    const a = [v1a, v2a, v3, v4a, v5a]
    const b = [v1b, v2b, v6, v3, v4b, v5b]

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: [0, "b"],
        val: 3,
      },
      {
        type: ChangeType.REMOVE,
        path: [1, "b"],
        num: 1,
      },
      {
        type: ChangeType.ADD,
        path: [2],
        vals: ["id"],
      },
      {
        type: ChangeType.ADD,
        path: [5, "c"],
        vals: [8],
      },
    ])
  }

  @Test()
  "complex array diff - set nested"() {
    const v1a = { a: 9, b: 2 }
    const v1b = { a: 9, b: "7" }
    const v2a = { a: 3, b: 4 }
    const v2b = { a: 4, b: 4 }
    const v3 = { a: 5, b: 6 }
    const v4 = { a: 7, b: 8 }
    const a = [v1a, v2a, v3, v4]
    const b = [v1b, v2b, v3, v4]

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: [0, "b"],
        val: "7",
      },
      {
        type: ChangeType.SET,
        path: [1, "a"],
        val: 4,
      },
    ])
  }

  @Test()
  "deep diff test"() {
    const a = {
      x: [1, 2, 3],
      y: {
        z: [
          { a: 1, b: 2 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [5, 6, 7],
        ],
      },
    }
    const b = {
      x: [1, 2, 4],
      y: {
        z: [
          { a: 1, b: 3 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [9, 8],
          [5, 6.2, 7],
        ],
      },
    }

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: ["x", 2],
        val: 4,
      },
      {
        type: ChangeType.SET,
        path: ["y", "z", 0, "b"],
        val: 3,
      },
      {
        type: ChangeType.SET,
        path: ["y", "aa", 1],
        val: [9, 8],
      },
      {
        type: ChangeType.ADD,
        path: ["y", "aa", 2],
        vals: [[5, 6.2, 7]],
      },
    ])
  }

  @Test()
  "immutable sequence"() {
    const a = Range(30, 60)
    const b = Range(50, 70)
    expectDiff(a, b, [
      {
        type: ChangeType.REMOVE,
        path: [0],
        num: 20,
      },
      {
        type: ChangeType.ADD,
        path: [10],
        vals: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
      },
    ])
  }

  @Test()
  "immutable map"() {
    const a = IMap({
      x: [1, 2, 3],
      y: IMap({
        z: [
          { a: 1, b: 2 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [5, 6, 7],
        ],
        q: {
          g: 8,
        },
      }),
    })
    const b = IMap({
      x: [1, 2, 4],
      y: IMap({
        z: [
          { a: 1, b: 3 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [9, 8],
          [5, 6.2, 7],
        ],
        q: {
          g: 8,
        },
      }),
    })

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: ["x", 2],
        val: 4,
      },
      {
        type: ChangeType.SET,
        path: ["y", "z", 0, "b"],
        val: 3,
      },
      {
        type: ChangeType.SET,
        path: ["y", "aa", 1],
        val: [9, 8],
      },
      {
        type: ChangeType.ADD,
        path: ["y", "aa", 2],
        vals: [[5, 6.2, 7]],
      },
    ])
  }

  @Test()
  "immutable record - change"() {
    const abcRecord = Record({ a: 1, b: 2, c: 10 })
    const a = new abcRecord({ b: 3, c: 10 })
    const b = new abcRecord({ a: 0 })

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: ["a"],
        val: 0,
      },
      {
        type: ChangeType.SET,
        path: ["b"],
        val: 2,
      }])
  }

  @Test()
  "immutable record - different records"() {
    const abcRecord = Record({ a: 1, b: 2, c: 10 })
    const abcRecord2 = Record({ a: 2, b: 4, c: 20 })
    const a = new abcRecord({ a: 1, b: 2, c: 10 })
    const b = new abcRecord2({ a: 1, b: 2, c: 10 })

    expectDiff(a, b, [
      {
        type: ChangeType.SET,
        path: [],
        val: b,
      }])
  }
}

@TestFixture()
class Regressions {
  @Test()
  "missing diff"() {
    const a = { b: [1, { x: "y", e: 1 }] }
    const b = { b: [1, { x: "z", e: 1 }, 5] }

    expectDiff(a, b, [
      {
        type: ChangeType.ADD,
        path: ["b", 2],
        vals: [5],
      },
      {
        type: ChangeType.SET,
        path: ["b", 1, "x"],
        val: "z",
      },
    ])
  }
}
