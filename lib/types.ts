// export type StrictUnionHelper<T, TAll> = T extends any
//   ? T & Partial<Record<Exclude<keyof TAll, keyof T>, never>>
//   : never;

// export type Res<T> = StrictUnionHelper<
//   | {
//       msg: "success";
//       data: T;
//     }
//   | { msg: Exclude<string, "success">; data: null },
//   | {
//       msg: "success";
//       data: T;
//     }
//   | { msg: Exclude<string, "success">; data: null }
// >;

export type Res<T> =
  | {
      msg: "success";
      data: T;
    }
  | { msg: Exclude<string, "success">; data: null };
