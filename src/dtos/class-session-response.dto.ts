import { ClassSessionStatus } from "@tutorify/shared";
import { ClassSession } from "src/read-repository";

export class ClassSessionResponse extends ClassSession {
    status: ClassSessionStatus;
}