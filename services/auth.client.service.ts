import { apiClientService } from "@/services/api.client.service";
import type {
  TSignInDto,
  TSignInResponse,
  TSignOutResponse,
} from "@/types/auth.type";

const AUTH_ENDPOINT = "auth/";

const signIn = (dto: TSignInDto): Promise<TSignInResponse> => {
  return apiClientService.post<TSignInDto, TSignInResponse>(
    `${AUTH_ENDPOINT}login`,
    dto,
  );
};

const signOut = (): Promise<TSignOutResponse> => {
  return apiClientService.post<undefined, TSignOutResponse>(
    `${AUTH_ENDPOINT}logout`,
  );
};

export const authClientService = {
  signIn,
  signOut,
};
