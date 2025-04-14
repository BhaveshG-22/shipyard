export function ManageReload<T extends (...args: number[]) => any>(fn: T): T {
    return ((...args: Parameters<T>) => {
      console.log("Arguments:", args);
      return fn(...args);
    }) as T;
  }
  
 
  