import { Level } from '../domain/types';

export const LEVELS: Level[] = [
    {
        id: 1,
        name: "The Basics",
        rows: 1, cols: 5,
        layout: [0, 0, 0, 0, 0],
        inventory: ['4', '+', '4', '=', '8', '2', '>'],
        description: "Form a true statement. Remember: at least one side needs a math operator!"
    },
    {
        id: 2,
        name: "Chain Reaction",
        rows: 1, cols: 7,
        layout: [0, 0, 0, 0, 0, 0, 0],
        inventory: ['1', '+', '2', '=', '3', '<', '9', '5', '−'],
        description: "You can chain comparators together!"
    },
    {
        id: 3,
        name: "The Crossword",
        rows: 5, cols: 5,
        layout: [
            0, 0, 0, 0, 0,
            0, 1, 1, 1, 0,
            0, 0, 0, 0, 0,
            0, 1, 1, 1, 0,
            0, 0, 0, 0, 0
        ],
        inventory: ['3', '+', '2', '=', '5', '×', '−', '2', '×', '2', '=', '4', '=', '=', '6', '−', '5', '=', '1', '9', '+', '<', '>'],
        description: "Statements must be mathematically true reading left-to-right AND top-to-bottom."
    }
];

export const DAILY_POOL = ['1', '2', '2', '3', '4', '5', '8', '+', '+', '−', '×', '=', '=', '<', '>'];
export const SORT_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '−', '×', '÷', '=', '<', '>'];
