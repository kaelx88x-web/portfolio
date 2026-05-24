declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      recommendedStrategy?: import('$lib/services/behavioral-profile.service').RecommendedStrategy;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
