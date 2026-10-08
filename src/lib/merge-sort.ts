export interface SortState<I> {
  arr: I[][];
  currentSize: number;
  leftStart: number;
  status?: 'done' | 'waiting' | 'end';
  mergeState?: MergeState<I>;
}

interface MergeState<I> {
  start: number;
  mid: number;
  end: number;
  leftArr?: I[][];
  rightArr?: I[][];
  leftArrIdx?: number;
  rightArrIdx?: number;
  arrIdx?: number;
}

export type Choice = 'left' | 'right' | 'tie';

const mergeCost = (n: number, size: number, leftStart: number) => {
  const mid = Math.min(leftStart + size - 1, n - 1);
  const end = Math.min(leftStart + 2 * size - 1, n - 1);
  return mid - leftStart + 1 + (end - mid) - 1;
};

export const calculateMaxComparisons = (n: number) => {
  let max = 0;
  for (let size = 1; size <= n - 1; size *= 2) {
    for (let ls = 0; ls < n - 1; ls += 2 * size) max += mergeCost(n, size, ls);
  }
  return max;
};

export const estimateComparisonsMade = <I>(state: SortState<I>) => {
  const { currentSize, leftStart, mergeState, arr } = state;
  const n = arr.length;
  let count = 0;
  for (let size = 1; size < currentSize; size *= 2) {
    for (let ls = 0; ls < n - 1; ls += 2 * size) count += mergeCost(n, size, ls);
  }
  for (let ls = 0; ls < leftStart; ls += 2 * currentSize) count += mergeCost(n, currentSize, ls);
  return count + (mergeState?.leftArrIdx ?? 0) + (mergeState?.rightArrIdx ?? 0);
};

export const initSort = <I>(arr: I[]): SortState<I> =>
  mergeSort({
    arr: arr.map((a) => [a]),
    currentSize: 1,
    leftStart: 0,
    status: arr.length <= 1 ? 'end' : 'waiting'
  });

export const mergeSort = <I>(state: SortState<I>): SortState<I> => {
  const { arr, status } = state;
  let { currentSize, leftStart } = state;
  let currentStepDone = status === 'done';
  const n = arr.length;

  for (; currentSize <= n - 1; currentSize = 2 * currentSize, leftStart = 0) {
    for (; leftStart < n - 1; leftStart += 2 * currentSize) {
      if (currentStepDone) {
        currentStepDone = false;
        continue;
      }
      const mid = Math.min(leftStart + currentSize - 1, n - 1);
      const end = Math.min(leftStart + 2 * currentSize - 1, n - 1);
      const res = merge({
        arr,
        currentSize,
        leftStart,
        mergeState: { start: leftStart, mid, end }
      });
      if (res.status !== 'done') return res;
    }
  }

  return { arr, currentSize: arr.length, leftStart: 0, status: 'end' };
};

export const merge = <I>(state: SortState<I>): SortState<I> => {
  const { arr, currentSize, leftStart, mergeState } = state;
  if (!mergeState) return state;
  const { start, mid, end } = mergeState;
  let { leftArrIdx = 0, rightArrIdx = 0, arrIdx = start, leftArr, rightArr } = mergeState;

  const n1 = mid - start + 1;
  const n2 = end - mid;

  if (!leftArr || !rightArr) {
    leftArr = arr.slice(start, mid + 1);
    rightArr = arr.slice(mid + 1, end + 1);
    leftArrIdx = 0;
    rightArrIdx = 0;
    arrIdx = start;
  }

  while (leftArrIdx < n1 && rightArrIdx < n2) {
    if (rightArr[rightArrIdx].length === 0) {
      arr[arrIdx++] = rightArr[rightArrIdx++];
    } else if (leftArr[leftArrIdx].length === 0) {
      arr[arrIdx++] = leftArr[leftArrIdx++];
    } else {
      return {
        arr,
        currentSize,
        leftStart,
        mergeState: { start, mid, end, leftArr, leftArrIdx, rightArr, rightArrIdx, arrIdx }
      };
    }
  }

  while (leftArrIdx < n1) arr[arrIdx++] = leftArr[leftArrIdx++];
  while (rightArrIdx < n2) arr[arrIdx++] = rightArr[rightArrIdx++];

  return { arr, currentSize, leftStart, status: 'done' };
};

const advance = <I>(state: SortState<I>) => {
  const next = merge(state);
  return next.mergeState ? next : mergeSort(next);
};

export const step = <I>(option: Choice, state: SortState<I>): SortState<I> => {
  const { currentSize, leftStart, mergeState } = state;
  if (!mergeState) return state;
  const arr = [...state.arr];
  const { start, mid, end, leftArr, rightArr } = mergeState;
  let { leftArrIdx, rightArrIdx, arrIdx } = mergeState;
  if (
    leftArr === undefined ||
    rightArr === undefined ||
    leftArrIdx === undefined ||
    rightArrIdx === undefined ||
    arrIdx === undefined
  )
    return state;

  if (option === 'tie') {
    arr[arrIdx] = [...leftArr[leftArrIdx], ...rightArr[rightArrIdx]];
    rightArr[rightArrIdx] = [];
    leftArrIdx++;
  } else if (option === 'left') {
    arr[arrIdx] = leftArr[leftArrIdx++];
  } else {
    arr[arrIdx] = rightArr[rightArrIdx++];
  }
  arrIdx++;

  return advance({
    arr,
    currentSize,
    leftStart,
    mergeState: { start, mid, end, leftArrIdx, rightArrIdx, arrIdx, leftArr, rightArr }
  });
};

export const removeItem = <I>(item: I, state: SortState<I>): SortState<I> => {
  const strip = (groups: I[][]) => groups.map((g) => g.filter((x) => x !== item));
  const arr = strip(state.arr);
  if (!state.mergeState?.leftArr || !state.mergeState.rightArr) return { ...state, arr };
  return advance({
    ...state,
    arr,
    mergeState: {
      ...state.mergeState,
      leftArr: strip(state.mergeState.leftArr),
      rightArr: strip(state.mergeState.rightArr)
    }
  });
};

export const getCurrentPair = <I>(state: SortState<I>) => {
  const m = state.mergeState;
  if (!m || m.leftArrIdx === undefined || m.rightArrIdx === undefined) return undefined;
  const left = m.leftArr?.[m.leftArrIdx];
  const right = m.rightArr?.[m.rightArrIdx];
  return left && right ? { left, right } : undefined;
};
