/**
 * Lagos Konect — Welcome Page (West)
 * Route: /west/welcome → /west/home
 */
import Onboarding from '../../../components/onboarding/Onboarding.js?v=20260806g';

export default class WelcomePage extends Onboarding {
  constructor(props) {
    super({ homeRoute: '/west/home', regionBrand: 'LagKonnect - West', ...props });
  }
}
