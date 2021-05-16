/* eslint-disable no-bitwise */
export type BitfieldValues = {
  [key: string]: number;
};

export class Bitfield<T extends BitfieldValues> {
  public fields: Record<keyof T, number>;

  public value: number;

  constructor(fields: Record<keyof T, number>, bits?: (keyof T | number)[]) {
    this.fields = fields;
    this.value = 0;
    if (bits) {
      for (let i = 0; i < bits.length; i += 1) {
        this.add(bits[i]);
      }
    }
  }

  public add(bit: keyof T | number): this {
    const bitNumber = this.convertToNumber(bit);
    this.value |= bitNumber;
    return this;
  }

  public remove(bit: keyof T | number): this {
    const bitNumber = this.convertToNumber(bit);
    this.value &= ~bitNumber;
    return this;
  }

  public has(bit: keyof T | number): boolean {
    const bitNumber = this.convertToNumber(bit);
    return (this.value & bitNumber) === bitNumber;
  }

  private convertToNumber(bit: keyof T | number): number {
    if (typeof bit === 'number') {
      return bit;
    }
    return 1 << Number(this.fields[bit]);
  }
}
