/**
 * Lagos Konect — Welcome Page (East)
 * Route: /east/welcome → /east/home
 */
import Onboarding from '../../../components/onboarding/Onboarding.js?v=20260806b';

export default class WelcomePage extends Onboarding {
  constructor(props) {
    super({ homeRoute: '/east/home', regionBrand: 'LagKonnect - East', ...props });
  }
}
