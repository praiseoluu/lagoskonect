/**
 * Lagos Konect — Welcome Page (Central)
 * Route: /central/welcome → /central/home
 */
import Onboarding from '../../../components/onboarding/Onboarding.js?v=20260806d';

export default class WelcomePage extends Onboarding {
  constructor(props) {
    super({ homeRoute: '/central/home', regionBrand: 'LagKonnect - Central', ...props });
  }
}
