import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

const ALLOWED_ROLES = ["USER", "MISSION_OPERATOR", "AUDIT", "ANALYST"] as const;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(ALLOWED_ROLES, { each: true })
  roles?: string[];
}
