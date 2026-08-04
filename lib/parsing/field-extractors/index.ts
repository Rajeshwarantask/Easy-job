/**
 * Field Extractors Index
 * 
 * Specialized extractors for common job application fields.
 * These are used across all platform parsers.
 */

export {
  extractSalary,
  formatSalary,
  type SalaryExtraction,
} from "./salary-extractor";

export {
  extractInterviewLinks,
  selectPrimaryInterviewLink,
  hasInterviewSchedulingContent,
  type InterviewLink,
} from "./interview-link-extractor";

export {
  extractDateTime,
  extractDeadline,
  formatDateTime,
  type DateTimeExtraction,
} from "./datetime-extractor";
