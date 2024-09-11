import * as Schema from '@effect/schema/Schema';
import type { HttpBody, HttpClientError } from "@effect/platform"
import { HttpClient, HttpClientRequest, HttpClientResponse } from '@effect/platform';
import * as Effect from "effect/Effect"
import type * as ParseResult from "@effect/schema/ParseResult"
import * as Context from 'effect/Context';
import * as Layer from "effect/Layer"
import { NodeHttpClient } from '@effect/platform-node';
import { EnvironmentService, EnvironmentServiceImpl } from './environment.service';


class LocalSystemData extends Schema.Class<LocalSystemData>("LocalSystemData")({
  memory: Schema.Struct({
    other: Schema.Number,
    atom: Schema.Number,
  }),
}) {
  static decodeResponse = HttpClientResponse.schemaBodyJsonScoped(LocalSystemData)
}

interface LocalSystemDataService {
  readonly get: () => Effect.Effect<LocalSystemData, HttpClientError.HttpClientError | HttpBody.HttpBodyError | ParseResult.ParseError>
}

export const LocalSystemDataService = Context.GenericTag<LocalSystemDataService>("collect_db_metrics/src/LocalSystemDataService");


const getEnvironment = EnvironmentService.pipe(
  Effect.map(envService => envService.get()),
);

const getCouchRequest = getEnvironment.pipe(
  Effect.map(({ couchUrl }) => HttpClientRequest.prependUrl(couchUrl)),
  Effect.map(req => HttpClient.mapRequest(req)),
);

const getHttpClient = HttpClient.HttpClient.pipe(
  Effect.map(HttpClient.filterStatusOk)
);

const clientWithBaseUrlEffect = Effect
  .all([
    getHttpClient,
    getCouchRequest
  ])
  .pipe(
    Effect.map(([client, request]) => request(client))
  );

const pipeCouchSystemService = clientWithBaseUrlEffect.pipe(
  Effect.map(client => () => HttpClientRequest
    .get("/_node/_local/_system")
    .pipe(request => client(request))
    .pipe(LocalSystemData.decodeResponse)
  ),
  Effect.map(get => LocalSystemDataService.of({ get })),
);

export const LocalSystemDataServiceImpl = Layer
  .effect(LocalSystemDataService, pipeCouchSystemService)
  .pipe(
    Layer.provide(NodeHttpClient.layer),
    Layer.provide(EnvironmentServiceImpl)
  );
