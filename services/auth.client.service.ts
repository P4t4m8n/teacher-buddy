import { apiClientService } from "@/services/api.client.service";
import type {
  TSignInDto,
  TSignInResponse,
  TSignOutResponse,
} from "@/types/auth.type";

const AUTH_ENDPOINT = "auth/";

export const authClientService = {
  signIn(dto: TSignInDto): Promise<TSignInResponse> {
    return apiClientService.post<TSignInDto, TSignInResponse>(
      `${AUTH_ENDPOINT}login`,
      dto,
    );
  },
  signOut(): Promise<TSignOutResponse> {
    return apiClientService.post<undefined, TSignOutResponse>(
      `${AUTH_ENDPOINT}logout`,
    );
  },
};
