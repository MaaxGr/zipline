import { Datasource } from '.';
import { ConfigSupabaseDatasource } from 'lib/config/Config';
import { guess } from 'lib/mimes';
import Logger from 'lib/logger';
import { Readable } from 'stream';

export class Supabase extends Datasource {
  public name = 'Supabase';
  public logger: Logger = Logger.get('datasource::supabase');

  public constructor(public config: ConfigSupabaseDatasource) {
    super();
  }

  public async save(file: string, data: Buffer): Promise<void> {
    const mimetype = await guess(file.split('.').pop());

    const r = await fetch(`${this.config.url}/storage/v1/object/${this.config.bucket}/${file}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.key}`,
        'Content-Type': mimetype,
      },
      body: data,
    });

    const j = await r.json();
    if (j.error) this.logger.error(`${j.error}: ${j.message}`);
  }

  public async delete(file: string): Promise<void> {
    await fetch(`${this.config.url}/storage/v1/object/${this.config.bucket}/${file}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.config.key}`,
      },
    });
  }

  public async clear(): Promise<void> {
    try {
      const resp = await fetch(`${this.config.url}/storage/v1/object/list/${this.config.bucket}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: '',
        }),
      });
      const objs = await resp.json();
      if (objs.error) throw new Error(`${objs.error}: ${objs.message}`);

      const res = await fetch(`${this.config.url}/storage/v1/object/${this.config.bucket}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefixes: objs.map((x: { name: string }) => x.name),
        }),
      });

      const j = await res.json();
      if (j.error) throw new Error(`${j.error}: ${j.message}`);

      return;
    } catch (e) {
      this.logger.error(e);
    }
  }

  public async get(file: string, start: number = 0, end: number = Infinity): Promise<Readable> {
    // get a readable stream from the request
    const r = await fetch(`${this.config.url}/storage/v1/object/${this.config.bucket}/${file}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.config.key}`,
        Range: `bytes=${start}-${end === Infinity ? '' : end}`,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Readable.fromWeb(r.body as any);
  }

  public size(file: string): Promise<number | null> {
    return new Promise(async (res) => {
      fetch(`${this.config.url}/storage/v1/object/list/${this.config.bucket}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: '',
          search: file,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.error) {
            this.logger.error(`${j.error}: ${j.message}`);
            res(null);
          }

          if (j.length === 0) {
            res(null);
          } else {
            res(j[0].metadata.size);
          }
        });
    });
  }

  public async fullSize(): Promise<number> {
    return new Promise((res) => {
      fetch(`${this.config.url}/storage/v1/object/list/${this.config.bucket}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prefix: '',
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.error) {
            this.logger.error(`${j.error}: ${j.message}`);
            res(0);
          }

          res(j.reduce((a, b) => a + b.metadata.size, 0));
        });
    });
  }
}
