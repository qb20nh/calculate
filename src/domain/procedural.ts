import { getRandomInt, seededRandom, setSeed } from './random'
import { Level } from './types'

export const generateEquationString = (levelId: number): string => {
  const maxVal = Math.min(100, 5 + Math.floor(levelId / 2))
  const useAdvanced = levelId > 5 && seededRandom() > 0.5

  const ops = ['+', '−', '×']
  if (levelId > 10) ops.push('÷')

  const op = ops[getRandomInt(0, ops.length - 1)]
  let a: number, b: number, c: number
  if (op === '+') {
    a = getRandomInt(1, maxVal)
    b = getRandomInt(1, maxVal)
    c = a + b
  } else if (op === '−') {
    c = getRandomInt(1, maxVal)
    b = getRandomInt(1, maxVal)
    a = c + b
  } else if (op === '×') {
    a = getRandomInt(1, Math.min(maxVal, 15))
    b = getRandomInt(1, Math.min(maxVal, 15))
    c = a * b
  } else if (op === '÷') {
    c = getRandomInt(1, Math.min(maxVal, 10))
    b = getRandomInt(1, Math.min(maxVal, 10))
    a = c * b
  } else {
    a = 1
    b = 1
    c = 2
  }

  let eq = `${a}${op}${b}=${c}`

  if (useAdvanced) {
    const comp = ['<', '>', '<>'][getRandomInt(0, 2)]
    const lastVal = c
    if (comp === '<') eq += `<${lastVal + getRandomInt(1, maxVal)}`
    if (comp === '>') {
      eq += `>${lastVal - getRandomInt(1, Math.max(1, lastVal - 1))}`
    }
    if (comp === '<>') eq += `<>${lastVal + getRandomInt(1, maxVal)}`
  }
  return eq
}

export const getProceduralLevel = (levelIndex: number): Level => {
  const levelId = levelIndex + 1
  setSeed(levelId * 12345)

  let maxWords = 1
  if (levelId > 3) maxWords = 2
  if (levelId > 10) maxWords = 3
  if (levelId > 25) maxWords = 4
  if (levelId > 50) maxWords = 5
  if (levelId > 100) {
    maxWords = Math.min(8, 5 + Math.floor((levelId - 100) / 50))
  }

  const board = new Map<string, string>()
  const placedWords: {
    word: string
    x: number
    y: number
    isHoriz: boolean
  }[] = []

  const canPlace = (
    word: string,
    startX: number,
    startY: number,
    isHoriz: boolean,
    currentBoard: Map<string, string>
  ) => {
    for (let i = 0; i < word.length; i++) {
      const x = isHoriz ? startX + i : startX
      const y = isHoriz ? startY : startY + i
      const key = `${x},${y}`
      if (currentBoard.has(key) && currentBoard.get(key) !== word[i]) {
        return false
      }

      if (isHoriz) {
        if (!currentBoard.has(key)) {
          if (
            currentBoard.has(`${x},${y - 1}`) ||
            currentBoard.has(`${x},${y + 1}`)
          ) {
            return false
          }
        }
        if (i === 0 && currentBoard.has(`${x - 1},${y}`)) return false
        if (i === word.length - 1 && currentBoard.has(`${x + 1},${y}`)) {
          return false
        }
      } else {
        if (!currentBoard.has(key)) {
          if (
            currentBoard.has(`${x - 1},${y}`) ||
            currentBoard.has(`${x + 1},${y}`)
          ) {
            return false
          }
        }
        if (i === 0 && currentBoard.has(`${x},${y - 1}`)) return false
        if (i === word.length - 1 && currentBoard.has(`${x},${y + 1}`)) {
          return false
        }
      }
    }
    return true
  }

  const firstWord = generateEquationString(levelId)
  for (let i = 0; i < firstWord.length; i++) board.set(`${i},0`, firstWord[i])
  placedWords.push({
    word: firstWord,
    x: 0,
    y: 0,
    isHoriz: true
  })

  let attempts = 0
  while (placedWords.length < maxWords && attempts < 150) {
    attempts++
    const targetWord = placedWords[getRandomInt(0, placedWords.length - 1)]
    const charIdx = getRandomInt(0, targetWord.word.length - 1)
    const targetChar = targetWord.word[charIdx]
    const intersectX = targetWord.isHoriz
      ? targetWord.x + charIdx
      : targetWord.x
    const intersectY = targetWord.isHoriz
      ? targetWord.y
      : targetWord.y + charIdx

    let newWord = ''
    for (let genAttempts = 0; genAttempts < 30; genAttempts++) {
      const cand = generateEquationString(levelId)
      if (cand.includes(targetChar)) {
        newWord = cand
        break
      }
    }
    if (!newWord) continue

    const indices = []
    for (let i = 0; i < newWord.length; i++) {
      if (newWord[i] === targetChar) indices.push(i)
    }
    const newCharIdx = indices[getRandomInt(0, indices.length - 1)]

    const isHoriz = !targetWord.isHoriz
    const startX = isHoriz ? intersectX - newCharIdx : intersectX
    const startY = isHoriz ? intersectY : intersectY - newCharIdx

    if (canPlace(newWord, startX, startY, isHoriz, board)) {
      for (let i = 0; i < newWord.length; i++) {
        const x = isHoriz ? startX + i : startX
        const y = isHoriz ? startY : startY + i
        board.set(`${x},${y}`, newWord[i])
      }
      placedWords.push({
        word: newWord,
        x: startX,
        y: startY,
        isHoriz
      })
    }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const key of board.keys()) {
    const [x, y] = key.split(',').map(Number)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  const cols = maxX - minX + 1
  const rows = maxY - minY + 1
  const layout: number[] = new Array<number>(rows * cols).fill(1)
  const inventoryChars: string[] = []

  for (const [key, char] of board.entries()) {
    const [x, y] = key.split(',').map(Number)
    layout[(y - minY) * cols + (x - minX)] = 0
    inventoryChars.push(char)
  }

  const numNoise = Math.floor(levelId / 5)
  const noisePool = [
    '+',
    '−',
    '×',
    '=',
    '<',
    '>',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9'
  ]
  for (let i = 0; i < numNoise; i++) {
    inventoryChars.push(noisePool[getRandomInt(0, noisePool.length - 1)])
  }

  for (let i = inventoryChars.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [inventoryChars[i], inventoryChars[j]] = [
      inventoryChars[j],
      inventoryChars[i]
    ]
  }

  return {
    id: levelId,
    displayTitle: `Level ${levelId - 3}`,
    displaySubtitle: '',
    rows,
    cols,
    layout,
    inventory: inventoryChars,
    description: ''
  }
}
